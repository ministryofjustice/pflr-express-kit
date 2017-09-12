jQuery(document).ready(function () {
  jQuery('[data-block-name]').each(function () {
    var dataBlockEdit = jQuery(this).closest('[data-block-name]')
    var block = dataBlockEdit.attr('data-block-name').replace(/_\d+$/, '')
    jQuery(this).prepend('<a href="/admin/block/' + block + '" target="_blank" class="block-edit" title="' + block + '"><span>✎</span></a>')
    jQuery('.block-edit', this)
      .on('mouseover', function () {
        dataBlockEdit.addClass('hover')
      })
      .on('mouseout', function () {
        dataBlockEdit.removeClass('hover')
      })
      .on('click', function (e) {
        e.stopPropagation()
        e.preventDefault()
        var $link = jQuery(this).closest('a')
        window.open($link.attr('href'), $link.attr('target'))
      })
  })
})
